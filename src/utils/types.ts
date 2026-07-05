
export type JobStage =
  | 'idle'
  | 'opening_ai_tab'
  | 'ai_generating'
  | 'ai_done'
  | 'opening_social_tab'
  | 'social_posting'
  | 'done'
  | 'error'

export interface JobProgress {
  stage: JobStage
  message: string
  error?: string
  content?: string
  updatedAt: number
}

export interface AppStorage {
  jobProgress?: JobProgress
  scheduled_posts?: Array<{
    content: string
    platform: string
    scheduleTime: number
  }>
  threadParagraphCount?: number
}

export type BgMessage =
  | { type: 'GENERATE_POST'; prompt: string; aiModel?: string }
  | { type: 'EXECUTE_POST'; platform: string; content: string }
  | { type: 'SCHEDULE_POST'; time: number; platform: string; content: string }
  | { type: 'GENERATE_AND_POST'; prompt: string; platform: string; paragraphCount?: number }
  | { type: 'GENERATE_AND_SCHEDULE'; prompt: string; platform: string; time: number; aiModel?: string; paragraphCount?: number }

export type BgResponse = { content?: string; success?: boolean; error?: string }
