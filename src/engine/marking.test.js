'use strict'

import test from 'node:test';
import assert from 'node:assert/strict';

import { selfMarkWrittenAnswer } from './marking.js';

test('marks a written answer as correct when the answer includes a required keyword', () => {
  const result = selfMarkWrittenAnswer('The queue follows first in first out', 'queue | first in first out');
  assert.equal(result.correct, true);
  assert.equal(result.score, 1);
});

test('marks a written answer as incorrect when it does not include the required ideas', () => {
  const result = selfMarkWrittenAnswer('It uses a stack structure', 'queue | first in first out');
  assert.equal(result.correct, false);
  assert.equal(result.score, 0);
});
