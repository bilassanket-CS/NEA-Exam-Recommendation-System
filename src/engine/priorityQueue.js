// src/engine/priorityQueue.js
// A binary max-heap used as a priority queue. The recommender pushes every
// candidate question with a numeric score and pops the highest-scoring ones.
// Implemented from scratch to demonstrate the data structure (OCR top-band).

export class MaxHeap {
  constructor() {
    this._items = []; // each: { priority:number, value:any }
  }

  get size() {
    return this._items.length;
  }

  peek() {
    return this._items.length ? this._items[0].value : undefined;
  }

  push(value, priority) {
    const items = this._items;
    items.push({ value, priority });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].priority >= items[i].priority) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop() {
    const items = this._items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      this._siftDown(0);
    }
    return top.value;
  }

  /** Remove and return up to n highest-priority values, in descending order. */
  popMany(n) {
    const out = [];
    while (out.length < n && this.size > 0) out.push(this.pop());
    return out;
  }

  _siftDown(i) {
    const items = this._items;
    const len = items.length;
    while (true) {
      let largest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < len && items[l].priority > items[largest].priority) largest = l;
      if (r < len && items[r].priority > items[largest].priority) largest = r;
      if (largest === i) break;
      [items[largest], items[i]] = [items[i], items[largest]];
      i = largest;
    }
  }
}
