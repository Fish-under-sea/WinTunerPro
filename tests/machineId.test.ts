import { describe, expect, it } from 'vitest'
import {
  GUID_RE,
  generateGuid,
  isStandardGuid,
  toTelemetryIdForm,
} from '@shared/utils/machineId'

describe('machineId 工具', () => {
  it('generateGuid 产出标准小写 GUID', () => {
    for (let i = 0; i < 50; i++) {
      const g = generateGuid()
      expect(GUID_RE.test(g)).toBe(true)
      expect(g).toBe(g.toLowerCase())
    }
  })

  it('generateGuid 多次调用不重复', () => {
    const set = new Set<string>()
    for (let i = 0; i < 200; i++) set.add(generateGuid())
    expect(set.size).toBe(200)
  })

  it('isStandardGuid 正确区分合法/非法输入', () => {
    expect(isStandardGuid('db77396c-6d51-4296-9dd9-d63aac6eccba')).toBe(true)
    expect(isStandardGuid('DB77396C-6D51-4296-9DD9-D63AAC6ECCBA')).toBe(true)
    // 带花括号不是标准形态（标准 MachineGuid 不含花括号）
    expect(isStandardGuid('{db77396c-6d51-4296-9dd9-d63aac6eccba}')).toBe(false)
    expect(isStandardGuid('not-a-guid')).toBe(false)
    expect(isStandardGuid('')).toBe(false)
    expect(isStandardGuid(123)).toBe(false)
    // 防注入：含命令分隔/路径字符必须判否
    expect(isStandardGuid('db77396c-6d51-4296-9dd9-d63aac6eccba; rmdir')).toBe(false)
  })

  it('toTelemetryIdForm 规整为花括号大写形态', () => {
    expect(toTelemetryIdForm('db77396c-6d51-4296-9dd9-d63aac6eccba')).toBe(
      '{DB77396C-6D51-4296-9DD9-D63AAC6ECCBA}',
    )
    // 输入已带花括号也能正确处理
    expect(toTelemetryIdForm('{db77396c-6d51-4296-9dd9-d63aac6eccba}')).toBe(
      '{DB77396C-6D51-4296-9DD9-D63AAC6ECCBA}',
    )
    expect(toTelemetryIdForm('garbage')).toBeNull()
  })
})
