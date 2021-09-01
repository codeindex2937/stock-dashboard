import HybridChart from '../chart/HybridChart.js';
export default {
	template: `
	<hybrid-chart
		ref="chart"
		:title="stockName"
		:link="'/history/' + stockId"
		:history="history"
	></hybrid-chart>`,
	components: {
		'hybrid-chart': HybridChart,
	},
	data() {
		return {
			polling: null,
			stockName: '',
			history: {
				time: [],
				value: [],
			},
		};
	},
	props: {
		stockId: {
			type: String,
			required: true
		}
	},
	async mounted() {
		var result = await eel.list_trade(this.stockId)();
		this.stockName = result.name;
		this.history = result.data.date.reduce((r, v, i) => {
			var date = new Date(v)
			date.setHours(9);
			date.setMinutes(0);
			date.setSeconds(0);
			r.time.push(date.getTime());
			r.value.push(result.data.open[i]);
			r.time.push(date.getTime() + 5400000);
			r.value.push(result.data.high[i]);
			r.time.push(date.getTime() + 10800000);
			r.value.push(result.data.low[i]);
			r.time.push(date.getTime() + 16600000);
			r.value.push(result.data.close[i]);
			return r;
		}, {
			time: [],
			value: [],
		});
		this.startPolling();
	},
	beforeUnmount () {
		this.stopPolling();
	},
	methods: {
		async getCurrentData() {
			var datas = await eel.get_stock_realtime([this.stockId])();
			if (this.stockId in datas) {
				this.$refs.chart.current = datas[this.stockId];

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
	},
};
