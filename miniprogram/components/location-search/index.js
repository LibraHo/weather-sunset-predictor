Component({
  properties: {
    value: { type: String, value: '' },
    locating: { type: Boolean, value: false },
    favoriteLoading: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    theme: { type: String, value: 'light' },
    candidates: { type: Array, value: [] }
  },

  methods: {
    onInput(event) {
      this.triggerEvent('change', { value: event.detail.value });
    },

    onConfirm(event) {
      this.triggerEvent('confirm', { value: event.detail.value });
    },

    onLocate() {
      this.triggerEvent('locate');
    },

    onFavorite() {
      this.triggerEvent('favorite');
    },

    onSelectCandidate(event) {
      this.triggerEvent('selectcandidate', {
        index: event.currentTarget.dataset.index
      });
    }
  }
});
