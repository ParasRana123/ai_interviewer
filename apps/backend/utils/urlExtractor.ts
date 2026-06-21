
export function extractProfiles(text: string) {
    const github = text.match(/github\.com\/([\w-]+)/i)
    const linkedin = text.match(/linkedin\.com\/in\/([\w-]+)/i);
    const leetcode = text.match(/leetcode\.com\/(u|profile)\/([\w-]+)/i);
    const codeforces =text.match(/codeforces\.com\/profile\/([\w-]+)/i);
    return {
        github: github?.[1],
        linkedin: linkedin?.[1],
        leetcode: leetcode?.[2],
        codeforces: codeforces?.[1]
    };
}