"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

// OpenRouter config
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export const generateAIInsights = async (industry) => {
  const prompt = `
Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:

{
  "salaryRanges": [
    { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
  ],
  "growthRate": number,
  "demandLevel": "High" | "Medium" | "Low",
  "topSkills": ["skill1", "skill2"],
  "marketOutlook": "Positive" | "Neutral" | "Negative",
  "keyTrends": ["trend1", "trend2"],
  "recommendedSkills": ["skill1", "skill2"]
}

IMPORTANT:
- Return ONLY valid JSON.
- No markdown.
- Include at least 5 salary roles.
- Growth rate must be percentage number only.
- Include at least 5 skills and trends.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini", // Fast + cheap + stable
      messages: [
        { role: "system", content: "You are a career industry analyst AI." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    const text = completion.choices[0].message.content;

    // Clean markdown if model returns it
    const cleanedText = text.replace(/```json|```/g, "").trim();

    return JSON.parse(cleanedText);

  } catch (error) {
    console.error("AI Generation Error:", error.message);
    throw new Error("Failed to generate AI insights");
  }
};

export async function getIndustryInsights() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: { industryInsight: true },
  });

  if (!user) throw new Error("User not found");

  // Generate if not exists
  if (!user.industryInsight) {
    const insights = await generateAIInsights(user.industry);

    const industryInsight = await db.industryInsight.create({
      data: {
        industry: user.industry,
        ...insights,
        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return industryInsight;
  }

  return user.industryInsight;
}