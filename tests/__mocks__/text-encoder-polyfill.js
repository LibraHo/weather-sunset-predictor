/**
 * TextEncoder/TextDecoder Polyfill for Jest
 * Required by some Node.js dependencies in test environment
 */

import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = NodeTextEncoder;
  global.TextDecoder = NodeTextDecoder;
}
