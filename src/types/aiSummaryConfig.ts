export interface AiSummaryModel {
	id: string;
	name: string;
	url: string;
	hasThinking: boolean;
}

export interface AiSummaryConfig {
	enabled: boolean;
	models: AiSummaryModel[];
	defaultModel: number;
}
