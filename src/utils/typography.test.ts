import { describe, expect, it } from "vitest"
import { bindDashes } from "./typography"

describe("bindDashes", () => {
  it("binds a dash run to the character before it, and nothing more", () => {
    expect(bindDashes("“当然。”他说——然后打开了设置页。")).toEqual([
      { text: "“当然。”他", nowrap: false },
      { text: "说——", nowrap: true },
      { text: "然后打开了设置页。", nowrap: false },
    ])
  })

  it("leaves a dash with nothing before it, or after a space, free to break", () => {
    expect(bindDashes("——开头")).toEqual([{ text: "——开头", nowrap: false }])
    expect(bindDashes("word ——next")).toEqual([{ text: "word ——next", nowrap: false }])
  })

  it("handles several dash runs and keeps the text intact", () => {
    const text = "甲——乙―丙"
    const runs = bindDashes(text)
    expect(runs.filter(run => run.nowrap).map(run => run.text)).toEqual(["甲——", "乙―"])
    expect(runs.map(run => run.text).join("")).toBe(text)
  })
})
