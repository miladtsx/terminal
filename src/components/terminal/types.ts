export type ContactInfo = {
    email: string;
    github: string;
    x: string;
};

export type CaseStudy = {
    title: string;
    desc: string;
};

export interface TerminalProps {
    prompt?: string;
    suggestedCommands?: string[];
    contact?: ContactInfo;
    caseStudies?: CaseStudy[];
    aboutLines?: string[];
}
