interface ReadlineOptions {
  input?: NodeJS.ReadableStream;
  crlfDelay?: number;
}

interface ReadlineInterface {
  on(event: 'line', listener: (line: string) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

export function createInterface(_options?: ReadlineOptions): ReadlineInterface {
  const self: ReadlineInterface = {
    on(_event: string, _listener: (line: string) => void): ReadlineInterface {
      return self;
    },
  };
  return self;
}