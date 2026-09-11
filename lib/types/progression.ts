export const ONE_PERCENT_BRAND_ASSET="/project-you-plus-logo.svg" as const;
export type ProgressionStage="Foundation"|"Momentum"|"Alignment"|"Elite"|"1%";
export type ProgressionAchievement={id:string;key:string;title:string;category:"score"|"milestone"|"behavior"|"elite";threshold:number|null;unlockedAt:string;metadata:Record<string,unknown>};
export type ProgressionState={stage:ProgressionStage;currentScore:number;highestScore:number;coveragePct:number;sustainedHighDays:number;onePercentUnlocked:boolean;onePercentUnlockedAt:string|null;calibrationDays:number;contributingDomains:number;numericLevel:null;numericProgressionAvailable:false;achievements:ProgressionAchievement[];brandAsset:typeof ONE_PERCENT_BRAND_ASSET|null};
