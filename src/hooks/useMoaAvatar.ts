import { useState } from "react";
import type { BotEmotion } from "../constants/emotionMap";

export function useMoaAvatar(initialEmotion: BotEmotion = "greeting") {
  const [emotion, setEmotion] = useState<BotEmotion>(initialEmotion);
  const [isTalking, setIsTalking] = useState(false);
  return { emotion, isTalking, setEmotion, setIsTalking };
}
