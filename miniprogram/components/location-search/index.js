Component({
  properties: {
    value: { type: String, value: '' },
    locating: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    theme: { type: String, value: 'light' }
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
    }
  }
});
