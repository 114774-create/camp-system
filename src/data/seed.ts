import { Camp, SystemSettings } from '../types'

const base = {
  term: '115學年度夏令營',
  season: 'summer' as const,
  ignore_time_conflict: false,
  allow_concurrent_with: [] as string[],
  location: '',
  teacher: '',
  notes: '',
}

export const SEED: Camp[] = [
  {
    ...base, id: 'c1', name: '桌遊營', name_en: 'Board Game Camp',
    attendance_mode: 'full_course',
    dates: ['2026-07-06', '2026-07-07', '2026-07-08'],
    start_time: '09:00', end_time: '12:00',
    allowed_grades: [1, 2, 3, 4, 5, 6], max_capacity: 30,
    has_sub_classes: true,
    sub_classes: [
      { id: 'A', name: 'A班', grades: [1, 2, 3] },
      { id: 'B', name: 'B班', grades: [4, 5, 6] },
    ],
    location: '會議室', teacher: '王老師', notes: '自備水壺',
  },
  {
    ...base, id: 'c2', name: '籃球營', name_en: 'Basketball Camp',
    attendance_mode: 'full_course',
    dates: ['2026-07-06'],
    start_time: '10:00', end_time: '12:00',
    allowed_grades: [3, 4, 5, 6], max_capacity: 20,
    has_sub_classes: false, sub_classes: [],
    location: '體育館', teacher: '李老師', notes: '穿運動服',
  },
  ...(['13', '14', '15'] as const).map((d, i) => ({
    ...base,
    id: `b${i}`,
    group_id: 'bake',
    name: '烘焙營',
    name_en: 'Baking Camp',
    attendance_mode: 'single_day_choice' as const,
    dates: [`2026-07-${d}`],
    start_time: '09:00', end_time: '12:00',
    allowed_grades: [1, 2, 3, 4, 5, 6],
    max_capacity: 2,
    has_sub_classes: false,
    sub_classes: [],
    location: '家政教室',
    teacher: '陳老師',
    notes: '自備圍裙',
  })),
]

export const DEFAULT_SETTINGS: SystemSettings = {
  id: 'default',
  admin_password: '2026',
  registration_start_at: '2025-12-01T00:00:00.000Z',
  registration_end_at: '2026-12-31T15:59:00.000Z',
  term_name: '115學年度夏令營',
}
