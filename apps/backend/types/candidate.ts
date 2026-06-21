
export interface CandidateProfile {
    name?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;

    education?: any[];
    experience?: any[];
    projects?: any[];
    achievements?: any[];
    skills?: any[];

    codingProfiles?: {
        leetcode?: string,
        codeforces?: string,
        codechef?: string
    };

    githubStats?: any;
    leetcodeStats?: any,
    codeforcesStats?: any
}