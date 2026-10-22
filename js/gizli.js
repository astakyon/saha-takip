// Gizli mod: açıkken uygulama hiçbir kaydını ya da konumunu dış servislere (Google, OpenStreetMap adres arama, Google konuşma tanıma) göndermez.
import { ayar } from './ayar.js';
export const gizliMod = () => ayar('gizli_mod', false) === true;
