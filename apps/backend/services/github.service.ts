import axios from "axios"

export async function getGithuStats(username: string) {
    const { data } = await axios.get(`https://api.github.com/users/${username}`)
    return {
        followers: data.followers,
        following: data.following,
        repos: data.repos,
        bio: data.bio
    };
}