/**
 * Minimal thread-stream stub to satisfy pino dependencies without workers.
 */
export default class ThreadStream {
  constructor() {}
  unref() {}
  worker = { terminate: () => {} };
  write() { return true; }
  end() {}
}





