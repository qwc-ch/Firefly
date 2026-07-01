import type { AiSummaryConfig } from "@/types/aiSummaryConfig";

export const aiSummaryConfig: AiSummaryConfig = {
	enabled: true,
	models: [
		{
			id: "gpt-oss",
			name: "GPT-OSS-120B",
			url: "https://i.520781.xyz/summarize",
			hasThinking: false,
		},
		{
			id: "deepseek-r1",
			name: "DeepSeek-R1",
			url: "https://i.520781.xyz/summarize2",
			hasThinking: true,
		},
		{
			id: "qwen",
			name: "Qwen-3.5-397B",
			url: "https://i.520781.xyz/summarize3",
			hasThinking: true,
		},
	],
	defaultModel: 0,
};
