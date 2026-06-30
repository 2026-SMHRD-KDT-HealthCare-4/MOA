import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system";
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
  retryCount?: number;
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
    retryCount: 0,
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
    // 0. 파일 존재 여부 체크 (네이티브 환경에서 임시 캐시 유실 대응)
    if (!isWeb && task.audioUri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(task.audioUri);
        if (!fileInfo.exists) {
          console.warn(`[OFFLINE_QUEUE] 로컬 파일 유실로 태스크 ${task.id} 폐기: ${task.audioUri}`);
          continue; // 큐에 보관하지 않고 즉시 버림 (무한 루프 방지)
        }
      } catch (checkErr) {
        console.warn(`[OFFLINE_QUEUE] 파일 체크 중 오류: ${task.id}`, checkErr);
      }
    }

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
      const currentRetry = (task.retryCount ?? 0) + 1;
      console.warn(`[OFFLINE_QUEUE] 태스크 동기화 실패 (재시도 횟수: ${currentRetry}): ${task.id}`, err);
      
      if (currentRetry >= 3) {
        console.error(`[OFFLINE_QUEUE] 최대 재시도(3회) 초과로 태스크 ${task.id} 강제 폐기`);
        // 3회 이상 실패 시 큐에서 제거하기 위해 activeQueue에 추가하지 않음
      } else {
        // 실패 건은 다음 시도를 위해 retryCount를 증가시켜 보존
        activeQueue.push({
          ...task,
          retryCount: currentRetry,
        });
      }
    }
  }

  await saveQueue(activeQueue);
}
