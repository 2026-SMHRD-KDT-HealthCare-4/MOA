import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { analyzeVoice, saveScriptRecord } from "../api/record";

const OFFLINE_QUEUE_KEY = "moa.offline.voice_queue";

export interface OfflineTask {
  id: string;
  audioUri: string;
  collectType: "SCRIPT" | "CHATBOT";
  scriptId?: string;
  userId: string;
  timestamp: number;
}

const isWeb = Platform.OS === "web";

async function getQueue(): Promise<OfflineTask[]> {
  try {
    const raw = isWeb
      ? globalThis.localStorage?.getItem(OFFLINE_QUEUE_KEY)
      : await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineTask[];
  } catch {
    return [];
  }
}

async function saveQueue(queue: OfflineTask[]): Promise<void> {
  try {
    const serialized = JSON.stringify(queue);
    if (isWeb) {
      globalThis.localStorage?.setItem(OFFLINE_QUEUE_KEY, serialized);
    } else {
      await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, serialized);
    }
  } catch (err) {
    console.error("오프라인 큐 저장 실패:", err);
  }
}

/**
 * 전송 실패한 녹음 태스크를 로컬 스토리지 큐에 저장합니다.
 */
export async function enqueueOfflineTask(
  audioUri: string,
  collectType: "SCRIPT" | "CHATBOT",
  userId: string,
  scriptId?: string,
): Promise<void> {
  const queue = await getQueue();
  const newTask: OfflineTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    audioUri,
    collectType,
    scriptId,
    userId,
    timestamp: Date.now(),
  };
  queue.push(newTask);
  await saveQueue(queue);
  console.log(`[OFFLINE_QUEUE] 태스크 추가 완료: ${newTask.id}`);
}

/**
 * 로컬 스토리지에 쌓여있는 오프라인 전송 실패 건들을 백엔드로 재동기화합니다.
 */
export async function syncOfflineQueue(): Promise<void> {
  const queue = await getQueue();
  if (queue.length === 0) return;

  console.log(`[OFFLINE_QUEUE] 오프라인 태스크 ${queue.length}건 동기화 개시...`);
  const activeQueue: OfflineTask[] = [];

  for (const task of queue) {
    try {
      // 1. 백엔드로 음향지표 분석 전송
      if (task.audioUri) {
        await analyzeVoice(task.audioUri, task.collectType);
      }
      // 2. 지정문구인 경우 낭독 이력 저장
      if (task.collectType === "SCRIPT" && task.scriptId) {
        await saveScriptRecord(task.scriptId, task.userId);
      }
      console.log(`[OFFLINE_QUEUE] 태스크 동기화 성공: ${task.id}`);
    } catch (err) {
      console.warn(`[OFFLINE_QUEUE] 태스크 동기화 실패 (유지): ${task.id}`, err);
      // 실패 건은 다음 시도를 위해 보존
      activeQueue.push(task);
    }
  }

  await saveQueue(activeQueue);
}
