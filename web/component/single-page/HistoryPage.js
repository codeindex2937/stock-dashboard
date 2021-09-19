import OHLCChart from '../chart/IndexChart.js';
export default {
	template: `
	<div style="min-height: 600px;">
		<stockchart
			:stock-id="stockId"
			:tags="tags || []"
			:target="tags.indexOf('major')>=0"
		></stockchart>
	</div>`,
	components: {
		'stockchart': OHLCChart,
	},
	data() {
		return {
			tags: [],
		};
	},
	props: {
		stockId: {
			type: String,
			required: true
		}
	},
	async mounted() {
		this.tags = (await eel.get_stock(this.stockId)()).tags;
	}
};
