// Minimal DOM doubles for isolated controller units, not browser or gameplay evidence.
export class ElementDouble extends EventTarget {
  dataset: Record<string,string> = {};
  style: Record<string,string> = {};
  innerHTML = '';
  hidden = false;
  appendChild() { return new ElementDouble(); }
  querySelector() { return new ElementDouble(); }
  remove() {}
  setPointerCapture() {}
  closest() { return null; }
}
