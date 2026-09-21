import { normalizeIndianPhoneNumber } from '../services/smsService.js';

console.log('--- TESTING PHONE NUMBER NORMALIZATION ---');

const testCases = [
  { input: '9663473286', expected: '+919663473286' },
  { input: '+919663473286', expected: '+919663473286' },
  { input: '919663473286', expected: '+919663473286' },
  { input: '96634 73286', expected: '+919663473286' },
  { input: '96634-73286', expected: '+919663473286' },
  { input: '123', expected: null },
  { input: null, expected: null }
];

let passed = 0;
for (const tc of testCases) {
  const result = normalizeIndianPhoneNumber(tc.input);
  if (result === tc.expected) {
    console.log(`✓ [PASS] "${tc.input}" => "${result}"`);
    passed++;
  } else {
    console.error(`❌ [FAIL] "${tc.input}" => Expected "${tc.expected}", got "${result}"`);
  }
}

if (passed === testCases.length) {
  console.log('✅ ALL PHONE NORMALIZATION TESTS PASSED');
} else {
  console.error('❌ SOME TESTS FAILED');
  process.exit(1);
}
