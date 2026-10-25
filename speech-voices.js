// 全站只用科學隊長的女性華語；繁體字（Hant）本身不代表台灣華語。
const MALE = /yunjhe|zhiwei|yunxi|yunyang|yunjian|yunze|kangkang|li-mu|limu|yu-shu|yushu|\bmale\b|男|雲哲|志瑋/i;
const FEMALE = /hsiaochen|hsiaoyu|yating|hanhan|mei-?jia|ting-?ting|\bflo\b|\bsandy\b|\bshelley\b|grandma|cmn-tw-x-ctc|xiaoxiao|xiaoyi|huihui|female|女|google|美嘉|雅婷|曉臻|曉雨|涵涵/i;
const TAIWAN = /hsiaochen|hsiaoyu|yating|hanhan|mei-?jia|yunjhe|zhiwei|美嘉|雅婷|曉臻|曉雨|涵涵|雲哲|志瑋/i;
const CANTONESE = /cantonese|\byue\b|sin[ -]?ji|hiugaai|hiumaan|wanlung|hong[ -]?kong|粵|粤|廣東|广东|香港/i;

function regionRank(voice) {
  const lang = String(voice.lang || '').replace(/_/g, '-').toLowerCase();
  const name = `${voice.name || ''} ${voice.voiceURI || ''}`;
  if (!/^(zh|cmn)(-|$)/.test(lang) || /(^|-)(yue|hk|mo)(-|$)/.test(lang) || CANTONESE.test(name)) return -1;
  if (/(^|-)tw(-|$)/.test(lang) || TAIWAN.test(name)) return 0;
  if (lang === 'zh-hant' || /^cmn(?:-hant)?$/.test(lang)) return 1;
  return 2; // 裝置沒有台灣聲音時，仍只退回其他地區的華語。
}

/** 只選可辨識的女性華語；優先台灣，絕不退回男聲、粵語或系統預設聲音。 */
export function pickCaptainVoice(available) {
  const ranked = available
    .filter((voice) => FEMALE.test(`${voice.name} ${voice.voiceURI || ''}`) && !MALE.test(`${voice.name} ${voice.voiceURI || ''}`))
    .map((voice) => ({ voice, rank: regionRank(voice) })).filter((v) => v.rank >= 0);
  if (!ranked.length) return undefined;
  const best = Math.min(...ranked.map((v) => v.rank));
  return ranked.find((v) => v.rank === best).voice;
}
