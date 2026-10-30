"""Offline augmentation of campus buildings with Overture and 3D-GloBFP data."""

import copy
import hashlib
import json
import math
import platform
from pathlib import Path

import shapely
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "public" / "data" / "sources"
OVERTURE_URL = "https://docs.overturemaps.org/guides/buildings/"
GLO_URL = "https://doi.org/10.5281/zenodo.15487006"
MIN_AREA = 20.0
MAX_OVERLAP = 1.0
MIN_IOU = 0.65
MIN_MARGIN = 0.15


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        value = float(value)
    except (ValueError, OverflowError):
        return None
    return value if math.isfinite(value) else None


def _height(value):
    value = _number(value)
    return value if value is not None and 3 <= value <= 60 else None


def _floors(value):
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value if 1 <= value <= 30 else None


def _pair(value):
    if not isinstance(value, (list, tuple)) or len(value) < 2:
        raise ValueError("invalid coordinate")
    x, y = _number(value[0]), _number(value[1])
    if x is None or y is None:
        raise ValueError("nonfinite or nonnumeric coordinate")
    return x, y


def _polygon(points):
    if len(points) < 3:
        raise ValueError("too few vertices")
    try:
        polygon = Polygon(points)
        if polygon.is_empty or not polygon.is_valid or polygon.area <= 0:
            raise ValueError("invalid or empty polygon")
        if not math.isfinite(polygon.area):
            raise ValueError("nonfinite polygon area")
        return polygon
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("polygon construction failed") from exc


def polygon_from_geo(geometry, project):
    """Validate and project a hole-free GeoJSON Polygon; raise ValueError otherwise."""
    if not isinstance(geometry, dict) or geometry.get("type") != "Polygon":
        raise ValueError("geometry is not a Polygon")
    rings = geometry.get("coordinates")
    if not isinstance(rings, (list, tuple)) or not rings:
        raise ValueError("missing polygon ring")
    if len(rings) != 1:
        raise ValueError("polygon has holes")
    ring = rings[0]
    if not isinstance(ring, (list, tuple)) or len(ring) < 4:
        raise ValueError("invalid polygon ring")
    geographic = [_pair(point) for point in ring]
    if geographic[0] != geographic[-1]:
        raise ValueError("polygon ring is not closed")
    if any(not (-180 <= lon <= 180 and -90 <= lat <= 90)
           for lon, lat in geographic):
        raise ValueError("coordinate outside WGS84 bounds")
    # Check the source as well: projection must not conceal invalid geometry.
    _polygon(geographic)
    projected = []
    for lon, lat in geographic:
        try:
            projected.append(_pair(project([lon, lat])))
        except Exception as exc:
            raise ValueError("coordinate projection failed") from exc
    return _polygon(projected)


def _geometry_id(geometry):
    """Hash the geographic ring independent of its starting point and direction."""
    ring = [_pair(point) for point in geometry["coordinates"][0][:-1]]
    ring = [(0.0 if x == 0 else x, 0.0 if y == 0 else y) for x, y in ring]
    variants = []
    for points in (ring, list(reversed(ring))):
        smallest = min(points)
        for i, point in enumerate(points):
            if point == smallest:
                variants.append(tuple(points[i:] + points[:i]))
    canonical = min(variants)
    payload = json.dumps(canonical, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def match_height(projected_polygon, glo_candidates):
    """Return a unique, high-IoU Glo height match, or a reason for rejection."""
    def result(reason, source_id=None, iou=None, height=None):
        return {
            "accepted": reason == "accepted",
            "height": height,
            "sourceId": source_id,
            "iou": iou,
            "reason": reason,
        }

    try:
        if (not isinstance(projected_polygon, Polygon) or projected_polygon.is_empty
                or not projected_polygon.is_valid or projected_polygon.area <= 0
                or not math.isfinite(projected_polygon.area)):
            return result("invalid_target_polygon")
        scores = []
        for polygon, height, source_id in glo_candidates:
            if (not isinstance(polygon, Polygon) or polygon.is_empty
                    or not polygon.is_valid or polygon.area <= 0
                    or not math.isfinite(polygon.area)):
                return result("invalid_candidate_polygon")
            intersection = projected_polygon.intersection(polygon).area
            if not math.isfinite(intersection):
                return result("intersection_error")
            if intersection <= 0:
                continue
            union = projected_polygon.area + polygon.area - intersection
            if not math.isfinite(union) or union <= 0:
                return result("intersection_error")
            iou = intersection / union
            if not math.isfinite(iou):
                return result("intersection_error")
            scores.append((iou, str(source_id), height))
    except Exception:
        return result("intersection_error")

    if not scores:
        return result("no_overlap")
    scores.sort(key=lambda item: (-item[0], item[1]))
    best, source_id, raw_height = scores[0]
    if best < MIN_IOU:
        return result("iou_below_threshold", source_id, best)
    if len(scores) > 1 and scores[1][0] > best - MIN_MARGIN:
        return result("ambiguous_match", source_id, best)
    height = _height(raw_height)
    if height is None:
        return result("invalid_height", source_id, best)
    return result("accepted", source_id, best, height)


def _read_features(path):
    try:
        with path.open("r", encoding="utf-8") as stream:
            data = json.load(stream)
    except (OSError, UnicodeError, ValueError) as exc:
        raise ValueError(f"Cannot read GeoJSON dataset {path}: {exc}") from exc
    if (not isinstance(data, dict) or data.get("type") != "FeatureCollection"
            or not isinstance(data.get("features"), list)):
        raise ValueError(f"Invalid GeoJSON FeatureCollection: {path}")
    return data["features"]


def _has_osm(value):
    if isinstance(value, str):
        return "openstreetmap" in value.casefold()
    if isinstance(value, list):
        return any(_has_osm(item) for item in value)
    if isinstance(value, dict):
        return any(_has_osm(item) for item in value.values())
    return False


def _existing_polygon(feature):
    points = feature.get("polygon")
    if not isinstance(points, (list, tuple)):
        raise ValueError("missing projected polygon")
    return _polygon([_pair(point) for point in points])


def augment_buildings(campus_id, features, project):
    """Return copied and augmented features plus a deterministic audit."""
    if not isinstance(campus_id, str) or not campus_id or any(
        char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"
        for char in campus_id
    ):
        raise ValueError("campus_id must contain only letters, digits, '-' or '_'")
    overture = _read_features(SOURCES / f"tyut-overture-{campus_id}.geojson")
    glo = _read_features(SOURCES / f"tyut-globfp-{campus_id}.geojson")
    output = copy.deepcopy(features)
    if not isinstance(output, list) or any(not isinstance(f, dict) for f in output):
        raise ValueError("features must be a list of feature dictionaries")

    audit = {
        "versions": {
            "algorithm": "augment-buildings-1",
            "python": platform.python_version(),
            "shapely": shapely.__version__,
        },
        "thresholds": {
            "minAreaM2": MIN_AREA,
            "maxOverlapM2": MAX_OVERLAP,
            "minIoU": MIN_IOU,
            "minIoUMargin": MIN_MARGIN,
            "minHeightM": 3,
            "maxHeightM": 60,
            "minFloors": 1,
            "maxFloors": 30,
            "floorHeightM": 3.5,
        },
        "counts": {
            "original": len(output),
            "overtureCandidates": len(overture),
            "gloCandidates": len(glo),
            "validGloGeometries": 0,
        },
        "candidateCount": len(overture),
        "acceptedAdded": 0,
        "rejected": [],
        "heightMatches": [],
        "heightRejections": [],
    }

    candidates = []
    for index, record in enumerate(glo):
        label = f"glo:{index}"
        try:
            if not isinstance(record, dict) or record.get("type") != "Feature":
                raise ValueError("not a GeoJSON Feature")
            geometry = record.get("geometry")
            polygon = polygon_from_geo(geometry, project)
            source_id = _geometry_id(geometry)
            properties = record.get("properties")
            if not isinstance(properties, dict):
                raise ValueError("invalid properties")
            candidates.append((polygon, properties.get("Height"), source_id))
        except ValueError as exc:
            audit["rejected"].append({"id": label, "reason": str(exc)})
    audit["counts"]["validGloGeometries"] = len(candidates)

    def apply_match(feature, polygon):
        match = match_height(polygon, candidates)
        entry = {"id": feature.get("id"), **match}
        if match["accepted"]:
            feature["height"] = match["height"]
            feature["heightStatus"] = "ml-estimate"
            feature["heightSource"] = {
                "dataset": "3D-GloBFP",
                "year": 2020,
                "method": "ML prediction; not survey",
                "matchIoU": match["iou"],
                "sourceId": match["sourceId"],
                "source": GLO_URL,
            }
            audit["heightMatches"].append(entry)
        else:
            audit["heightRejections"].append(entry)

    occupied = []
    unsafe_original = False
    ids = set()
    for index, feature in enumerate(output):
        feature_id = feature.get("id")
        if isinstance(feature_id, str):
            ids.add(feature_id)
        if feature.get("kind") != "building":
            continue
        try:
            polygon = _existing_polygon(feature)
        except ValueError as exc:
            audit["rejected"].append({
                "id": feature_id if isinstance(feature_id, str) else f"original:{index}",
                "reason": f"invalid original building geometry: {exc}",
            })
            # An invalid original cannot safely be used for overlap exclusion.
            unsafe_original = True
            continue
        occupied.append(polygon)
        levels = _number(feature.get("levels"))
        if feature.get("heightStatus") != "osm-tag" and not (
            levels is not None and levels > 0
        ):
            apply_match(feature, polygon)

    def record_id(record):
        if isinstance(record, dict) and isinstance(record.get("properties"), dict):
            value = record["properties"].get("id")
            if isinstance(value, str):
                return value
        return ""

    ordered = sorted(enumerate(overture), key=lambda item: (record_id(item[1]), item[0]))
    for index, record in ordered:
        source_id = record_id(record)
        label = f"overture:{source_id}" if source_id else f"overture-record:{index}"
        try:
            if not isinstance(record, dict) or record.get("type") != "Feature":
                raise ValueError("not a GeoJSON Feature")
            if not source_id:
                raise ValueError("missing or invalid Overture id")
            if label in ids:
                raise ValueError("duplicate feature id")
            properties = record["properties"]
            polygon = polygon_from_geo(record.get("geometry"), project)
            if polygon.area < MIN_AREA:
                raise ValueError("area below 20 m2")
            if unsafe_original:
                raise ValueError("overlap cannot be checked against invalid original building")
            try:
                overlaps = any(
                    polygon.intersection(other).area > MAX_OVERLAP for other in occupied
                )
            except Exception as exc:
                raise ValueError("overlap check failed") from exc
            if overlaps:
                raise ValueError("overlap exceeds 1 m2")

            floors = _floors(properties.get("num_floors"))
            feature = {
                "id": label,
                "name": "校园建筑（名称待核）",
                "kind": "building",
                "polygon": [[float(x), float(y)] for x, y in polygon.exterior.coords],
                "height": 12,
                "heightStatus": "unverified",
                "levels": floors,
                "source": OVERTURE_URL,
                "sourceId": source_id,
            }
            explicit_height = _height(properties.get("height"))
            if explicit_height is not None and _has_osm(properties.get("sources")):
                feature["height"] = explicit_height
                feature["heightStatus"] = "osm-tag"
                feature["heightSource"] = {
                    "dataset": "OpenStreetMap",
                    "method": "explicit height via Overture",
                    "sourceId": source_id,
                    "source": OVERTURE_URL,
                }
            elif floors is not None:
                feature["height"] = floors * 3.5
                feature["heightStatus"] = "level-estimate"
                feature["heightSource"] = {
                    "dataset": "Overture Maps",
                    "method": "num_floors × 3.5 m",
                    "sourceId": source_id,
                    "source": OVERTURE_URL,
                }
            else:
                apply_match(feature, polygon)

            output.append(feature)
            occupied.append(polygon)
            ids.add(label)
            audit["acceptedAdded"] += 1
        except ValueError as exc:
            audit["rejected"].append({"id": label, "reason": str(exc)})

    audit["counts"]["output"] = len(output)
    audit["counts"]["heightMatches"] = len(audit["heightMatches"])
    audit["counts"]["heightRejections"] = len(audit["heightRejections"])
    audit["counts"]["rejected"] = len(audit["rejected"])
    return output, audit
