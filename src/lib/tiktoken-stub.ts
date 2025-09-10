export type Encoding = {
  encode: (text: string) => number[];
  decode: (tokens: number[]) => string;
  free: () => void;
};

export function encoding_for_model(_model: string): Encoding {
  return makeEncoding();
}

export function get_encoding(_name: string): Encoding {
  return makeEncoding();
}

function makeEncoding(): Encoding {
  return {
    encode(text: string): number[] {
      if (!text) return [];
      const approx = Math.max(1, Math.ceil(text.length / 4));
      const out = new Array(approx);
      for (let i = 0; i < approx; i++) out[i] = 1000 + (i % 100);
      return out;
    },
    decode(tokens: number[]): string {
      if (!Array.isArray(tokens) || tokens.length === 0) return '';
      return 'x'.repeat(tokens.length * 4);
    },
    free(): void {
    },
  };
}

