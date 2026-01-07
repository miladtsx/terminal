export type CommandSegment = {
    type: "command";
    label: string;
    command: string;
    ariaLabel?: string;
};

export type CopySegment = {
    type: "copy";
    value: string;
    label?: string;
    ariaLabel?: string;
};

export type TextSegment = {
    type: "text";
    text: string;
};

export type LineSegment = TextSegment | CommandSegment | CopySegment;
export type TerminalLine = LineSegment[];
export type TerminalLineInput = string | TerminalLine;

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
