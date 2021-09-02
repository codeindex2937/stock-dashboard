export default {
	template: `
	<select v-model="selected" class="form-select" style="display: inline-block;width: auto;">
		<option value="rising">rising</option>
		<option value="jitter">jitter</option>
		<option value="falling">falling</option>
	</select>`,
	props: {
		stockId: {
			type: String,
			required: true
		},
		modelValue: {
			type: String,
			default: ''
		}
	},
	emits: ['update:modelValue'],
	computed: {
		selected: {
			get: function () {return this.modelValue;},
			set: function(v) {this.$emit('update:modelValue', v);eel.update_tag(this.stockId, v)();},
		},
	}
};
