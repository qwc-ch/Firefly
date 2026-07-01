import type { AiSummaryConfig } from "@/types/aiSummaryConfig";

export const aiSummaryConfig: AiSummaryConfig = {
	enabled: true,
	models: [
		{
			id: "minimax-m3",
			name: "MiniMax-M3",
			url: "https://i.520781.xyz/summarize",
			hasThinking: false,
		},
		{
			id: "qwen",
			name: "Qwen-3.5-397B",
			url: "https://i.520781.xyz/summarize2",
			hasThinking: true,
		},
	],
	defaultModel: 0,
};
