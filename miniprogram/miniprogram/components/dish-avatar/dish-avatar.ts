// 菜品没有图片时的头像：按分类取色，显示菜名首字。
const CATEGORY_TONES: Record<string, string> = {
  早餐: 'breakfast',
  午餐: 'lunch',
  晚餐: 'dinner'
}

Component({
  properties: {
    name: { type: String, value: '' },
    category: { type: String, value: '' },
    /** sm | md | lg */
    size: { type: String, value: 'md' },
    /** done：已做完，显示对勾；muted：不吃了，置灰 */
    state: { type: String, value: '' }
  },

  data: {
    initial: '',
    tone: 'other'
  },

  observers: {
    'name, category'(name: string, category: string) {
      this.setData({
        initial: (name || '').trim().slice(0, 1),
        tone: CATEGORY_TONES[category] || 'other'
      })
    }
  }
})
