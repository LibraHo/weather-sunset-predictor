Component({
  properties: {
    score: { type: Number, optionalTypes: [String], value: null },
    grade: { type: String, value: '' },
    locationName: { type: String, value: '' },
    period: { type: String, value: 'sunset' },
    bestWindow: { type: String, value: '' },
    explanation: { type: String, value: '' }
  },

  data: {
    scoreText: '--',
    gradeLabel: '待判断',
    gradeClass: 'grade-waiting',
    scoreClass: 'score-waiting',
    periodLabel: '晚霞'
  },

  observers: {
    'score, grade, period': function () {
      this.refreshView();
    }
  },

  lifetimes: {
    attached() {
      this.refreshView();
    }
  },

  methods: {
    refreshView() {
      const score = Number(this.properties.score);
      const hasScore = Number.isFinite(score);
      const grade = this.properties.grade || this.gradeFromScore(score);

      this.setData({
        scoreText: hasScore ? String(Math.round(score)) : '--',
        gradeLabel: this.gradeLabel(grade, score),
        gradeClass: this.gradeClass(grade, score),
        scoreClass: this.scoreClass(score),
        periodLabel: this.properties.period === 'sunrise' ? '朝霞' : '晚霞'
      });
    },

    gradeFromScore(score) {
      if (!Number.isFinite(score)) return '';
      if (score >= 85) return 'excellent';
      if (score >= 70) return 'good';
      if (score >= 40) return 'fair';
      return 'low';
    },

    gradeLabel(grade, score) {
      const map = {
        excellent: '极佳',
        great: '极佳',
        good: '较好',
        fair: '可关注',
        low: '偏弱',
        poor: '偏弱'
      };
      return map[grade] || (Number.isFinite(score) ? this.gradeLabel(this.gradeFromScore(score), score) : '待判断');
    },

    gradeClass(grade, score) {
      const normalized = grade || this.gradeFromScore(score);
      if (normalized === 'excellent' || normalized === 'great') return 'grade-hot';
      if (normalized === 'good') return 'grade-good';
      if (normalized === 'fair') return 'grade-fair';
      return 'grade-low';
    },

    scoreClass(score) {
      if (!Number.isFinite(score)) return 'score-waiting';
      if (score >= 85) return 'score-excellent';
      if (score >= 65) return 'score-good';
      if (score >= 40) return 'score-fair';
      return 'score-poor';
    }
  }
});
