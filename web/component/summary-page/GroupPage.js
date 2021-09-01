import HybridChart from '../chart/HybridChart.js';
import { debounce } from '../../js/vue-debounce.js';
export default {
	template: `
	<div>
		<div style="display:flex;flex-wrap:wrap;justify-content:space-around">
			<hybrid-chart
				v-for="group in sorted_groups"
				:title="group.title"
				:history="{time: group.time, value: group.value}"
				style="min-width: 150;min-height: 120px"
				:ref="group.key"
				:key="group.key"
				:link="'/tag/' + group.id"
				@trend-change="reorder"
			></hybrid-chart>
		</div>
	</div>`,
	components: {
		'hybrid-chart': HybridChart,
	},
	data() {
		return {
			groups: {},
			sorted_groups: [],
			polling: null,
		}
	},
	beforeUnmount () {
		this.stopPolling();
	},
	async mounted() {
		this.groups = await eel.get_group_history()();
		
		var sorted_groups = [];
		for (var group of Object.values(this.groups)) {
			sorted_groups.push(group);
		}
		this.sorted_groups = sorted_groups;
		var self = this;
		self.startPolling();
		
	},
	methods: {
		reorder: debounce(function() {
			this.$nextTick(() => {
				var self = this;
				self.sorted_groups.sort((l, r) => {
					var l_trend = self.$refs[l.key].trend;
					var r_trend = self.$refs[r.key].trend;
					if (l_trend > r_trend) {
						return -1;
					}
					if (l_trend < r_trend) {
						return 1;
					}
					return 0;
				});
			}, '1s');
		}),
		async getCurrentData() {
			var datas = await eel.get_group_realtime()();
			for (var [key, data] of Object.entries(datas)) {
				this.$refs[key].current.time = data.time;
				this.$refs[key].current.value = data.value;
			}
		},
		startPolling() {
			if (this.polling) {
				return;
			}
			this.polling = setInterval(this.getCurrentData, 60 * 1000);
			this.getCurrentData();
		},
		stopPolling() {
			if (this.polling) {
				clearInterval(this.polling);
				this.polling = null;
			}
		},
	}
};
