// 故事卡只留一小段完整句子；同一段文字也用來製作隊長語音。
export function shortIntro(episode, content) {
  const normalize = (text) => String(text || '').replace(/^小朋友[，,]\s*/, '').replace(/\s+/g, ' ').trim();
  const fallback = content?.takeaways?.[0]?.text || content?.card?.description || `一起聽聽「${episode.title}」，發現裡面的科學祕密！`;
  const text = normalize(episode.intro || fallback);
  const sentences = text.match(/[^。！？!?]+[。！？!?]*[」』）)]*/g)?.map((s) => s.trim()).filter(Boolean) || [text];
  let summary = sentences[0];
  if (Array.from(summary).length > 90) {
    const takeaway = normalize(content?.takeaways?.[0]?.text);
    if (takeaway && Array.from(takeaway).length <= 90) return takeaway;
    const title = Array.from(normalize(episode.title)).slice(0, 55).join('');
    return `這集帶你認識「${title}」，一起探索背後的科學祕密！`;
  }
  if (sentences[1] && Array.from(summary + sentences[1]).length <= 90) summary += sentences[1];
  return summary;
}
