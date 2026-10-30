# Dense source-backed campus integration

C2 + R-data + R-ui + R-architecture + A2. Research before plan completed2026-10-30: originalplans/AGENTS/currentstate read, officialdataset/MCP research, actualbbox extraction and pixelinspection. Sol API plan completed, adapted below to actualfiles/no unnecessaryfeatureflags.

## G0
Product core: browser exploration of recognizable TYUT campuses with a coherent playable journey.
Primary user: campus visitors/students exploring and recognizing landmarks.
Role ownership: source datasets retain provenance; deterministic offline code transforms; runtime renders; user judges major visual outcomes.
Non-goals: surveying, exactnavigation, backend/multiplayer, publicdeployment, newMCPcredentials or paidservices.
Forbidden claims: candidatecount is realbuildingcount; MLheight is survey; officialphotos supply unknown dimensions; allcampusmodeling done.

## Evidence and reuse
Overture2026-10-21 actual100Huyu143Yingxi candidates,15oldOSMfootprints IoU1.0. ODbL. GloBFP2020 MLheight CC BY4.0,119/200candidates withtinyfragments and contradictions; retainonlyhigh-IoU heightmatches withnoconflictingOSMheight/floors. Primarysources: https://docs.overturemaps.org/guides/buildings/ ; https://docs.overturemaps.org/attribution/ ; https://doi.org/10.5281/zenodo.15487006 . ThreeofficialBufferGeometryUtils mergeGeometries reuse checked https://threejs.org/docs/pages/module-BufferGeometryUtils.html . Actualinstalled Three0.186.1 addon supports compatibleattribute merge.

## Files and ownership
Parent owns sharedcontracts.ts, App.vue,heightlabels, build_spatial_data.py integration, sourcefiles/manifest/licenses, tests and finalpublication. Terra writes scripts/augment_buildings.py and proposes targeted CampusScene.ts backgroundbatching patch; no concurrentwrites. OriginalknownlandmarkIDs/order remain. Source snapshots under public/data/sources, audit under public/data; no68MBtile orschoolphotos committed.

## Rules and sequence
1.FreezeoptionalheightSource{dataset,year,method,matchIoU,sourceId} and heightStatus ml-estimate.
2.Preserve15OSMnamedfootprints/heights/floors. SupplementOverture polygons area>=20m2; rejectinvalid/holes(unexpectedinthisrelease)/duplicates/overlaps withacceptedfeatures. No silentgeometryrepair.
3.Forunknownheight only, unique MLmatch IoU>=.65, runnerupambiguity check, predictedheight3..60m; otherwiseexplicitdisplayfallback, preserveexistingfallbackvalue. Neveroverwrite13floormainwith9mML. Audit everyaccept/reject.
4.Recompute allroutes againstallacceptedbuildingbuffers. No straightline fallback. Failifrequiredstation unreachable orrouteinvalid.
5.Batchbackgroundmeshesby4materials viaofficialmergeGeometries. Keepknownlandmarksmesh/picking independent; limitbackgroundwindowdensity, sharedinstances; deterministicdisposal.
6.Typecheck/lint/unit/build, Pythonmatcher regression+deterministicgeneration+geometryroutevalidation, realbrowser fulljourney/pinch/switch/fallback, inspectbothcampusdesktop/mobilepixels. Recordactualrenderer drawcalls/trianglecounts; no unmeasured30FPSclaim.
7.Pushdev, CIthenmain onlyaftertests. Rollbackgenerateddata+routes together via priorcommit4ee33f; revertbatching separately ifneeded.

Completionofthisslice meansdenserprovenance-awaretechnicalscene, notfinalaestheticrelease. Nextslice usesofficialphotos forrecognizablelandmarkasset, noinventeddimensions.
