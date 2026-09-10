
const RESERVED_USERNAMES = new Set([
    "about", "contact", "pricing", "features", "login", "signup", "explore",
    "orgs", "organizations", "settings", "notifications", "topics", "pulls", "issues"
]);

export function extractProfiles(text: string) {
    const github = text.match(/github\.com\/([\w-]+)/i);
    const linkedin = text.match(/linkedin\.com\/in\/([\w-]+)/i);
    const leetcode = text.match(/leetcode\.com\/(?:u|profile)\/([\w-]+)/i);
    const codeforces = text.match(/codeforces\.com\/profile\/([\w-]+)/i);

    const githubUser = github?.[1];
    const leetcodeUser = leetcode?.[1];
    const codeforcesUser = codeforces?.[1];

    return {
        github: githubUser && !RESERVED_USERNAMES.has(githubUser.toLowerCase()) ? githubUser : undefined,
        linkedin: linkedin?.[1],
        leetcode: leetcodeUser && !RESERVED_USERNAMES.has(leetcodeUser.toLowerCase()) ? leetcodeUser : undefined,
        codeforces: codeforcesUser && !RESERVED_USERNAMES.has(codeforcesUser.toLowerCase()) ? codeforcesUser : undefined,
    };
}