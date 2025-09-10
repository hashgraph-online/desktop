
import { Tiktoken, getEncodingNameForModel } from 'js-tiktoken'
import type { TiktokenModel } from 'js-tiktoken'
import cl100k_base from 'js-tiktoken/ranks/cl100k_base'
import r50k_base from 'js-tiktoken/ranks/r50k_base'
import p50k_base from 'js-tiktoken/ranks/p50k_base'
import p50k_edit from 'js-tiktoken/ranks/p50k_edit'
import gpt2 from 'js-tiktoken/ranks/gpt2'
import o200k_base from 'js-tiktoken/ranks/o200k_base'

export type Encoding = Tiktoken

const RANKS: Record<string, any> = {
  cl100k_base,
  r50k_base,
  p50k_base,
  p50k_edit,
  gpt2,
  o200k_base,
}

export function get_encoding(name: string): Encoding {
  const ranks = RANKS[name]
  if (!ranks) {
    throw new Error(`Unsupported encoding: ${name}`)
  }
  return new Tiktoken(ranks)
}

export function encoding_for_model(model: string): Encoding {
  const encName = getEncodingNameForModel(model as unknown as TiktokenModel)
  return get_encoding(encName)
}

