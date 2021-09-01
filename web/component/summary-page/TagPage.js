import StockChart from '../chart/OHLCChart.js';
export default {
	template: `
	<div>
		<div style="display: flex;flex-wrap:wrap;justify-content:space-around">
			<stockchart
				v-for="stock in selected"
				:stock-id="stock.stock_id"
				:tags="stock.tags || ''"
				:target="stock.tags.indexOf('major')>=0"
				style="min-width: 350px;min-height: 300px"
			></stockchart>
		</div>
	</div>`,
	components: {
		'stockchart': StockChart,
	},
	data() {
		return {
			selected: []
		}
	},
	props: {
		tags: {
			type: Array,
			default: []
		}
	},
	async mounted() {
		var priority = function(stock) {
			var score = 0;
			if (stock.tags.indexOf('rising') >= 0) {
				score += 0;
			}
			else if (stock.tags.indexOf('falling') >= 0) {
				score += 100000;
			}
			else if (stock.tags.indexOf('jitter') >= 0) {
				score += 200000;
			}
			else {
				score += 300000;
			}
			score -= stock.last_close;

			return score;
		}

		var stocks = await eel.list_target(Object.values(this.tags))();
		this.selected = stocks.sort(function(l, r) {
			var lScore = priority(l);
			var rScore = priority(r);
			if (lScore < rScore) {
				return -1;
			}
			if (lScore > rScore) {
				return 1;
			}

			return 0;
		});
	}
};
