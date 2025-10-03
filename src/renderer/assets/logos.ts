/**
 * Import all DAO member logos as static assets for proper bundling
 */

import { getAssetUrl } from '../utils/assets';

import BonzoDark from './images/logos/dao/Bonzo_Dark.png';
import BuidlerLabs from './images/logos/dao/Buidler Labs.png';
import Hashpack from './images/logos/dao/Hashpack.png';
import Hashgate from './images/logos/dao/Hashgate.png';
import HGRAPH from './images/logos/dao/HGRAPH.png';
import Launchbadge from './images/logos/dao/Launchbadge.png';
import Neuron from './images/logos/dao/Neuron.png';
import SentX from './images/logos/dao/SentX.png';
import KiloscribeDark from './images/logos/dao/Kiloscribe_Dark.png';
import Turtlemoon from './images/logos/dao/Turtlemoon.png';

export const daoLogos: Record<string, string> = {
  'Bonzo_Dark.png': getAssetUrl(BonzoDark),
  'Buidler Labs.png': getAssetUrl(BuidlerLabs),
  'Hashpack.png': getAssetUrl(Hashpack),
  'Hashgate.png': getAssetUrl(Hashgate),
  'HGRAPH.png': getAssetUrl(HGRAPH),
  'Launchbadge.png': getAssetUrl(Launchbadge),
  'Neuron.png': getAssetUrl(Neuron),
  'SentX.png': getAssetUrl(SentX),
  'Kiloscribe_Dark.png': getAssetUrl(KiloscribeDark),
  'Turtlemoon.png': getAssetUrl(Turtlemoon),
};