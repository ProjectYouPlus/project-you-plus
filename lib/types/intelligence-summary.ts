export type CalibrationSummary={coveragePct:number;scoreDays:number;status:"calibrating"|"established";missingDomains:string[];message:string};
export type ProjectedScoreImpact={domain:string;estimatedPoints:{low:number;high:number};basis:string}|null;
export type PatternObservation={key:string;observation:string;whyItMatters:string;evidenceIds:string[];confidence:"medium"|"high"};
export type RetentionIntelligence={
 generatedAt:string;
 daily:{headline:string;priorities:string[];fixedCommitments:Array<{id:string;title:string;startAt:string;endAt:string}>;coverage:CalibrationSummary};
 evening:{headline:string;completionPct:number|null;completed:number;planned:number;explanation:string};
 weeklyReviewInput:{window:{from:string;to:string};eventCounts:Record<string,number>;score:{current:number;change:number|null;high:number;low:number}|null;activeDays:number;patterns:PatternObservation[]};
 scoreExplanation:{score:number;change:number|null;strongest:string|null;opportunity:string|null;rationale:Record<string,string>;coverage:CalibrationSummary};
 historicalTrend:{direction:"up"|"down"|"flat"|"unavailable";change:number|null;average:number|null;points:Array<{date:string;score:number}>};
 projectedScoreImpact:ProjectedScoreImpact;
 achievementNotices:Array<{achievementId:string;title:string;unlockedAt:string;kind:"achievement"|"milestone"}>;
};
