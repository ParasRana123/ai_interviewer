import { z } from "zod";

const EducationSchema = z.object({
    institution: z.string().nullable(),
    degree: z.string().nullable(),
    cgpa: z.string().nullable(),
    duration: z.string().nullable(),
    relevantCoursework: z.array(z.string())
})

const ExperienceSchema = z.object({
    company: z.string().nullable(),
    role: z.string().nullable(),
    duration: z.string().nullable(),
    location: z.string().nullable(),
    description: z.array(z.string())
})

const ProjectSchema = z.object({
    title: z.string().nullable(),
    techStack: z.array(z.string()),
    highlights: z.array(z.string())
})

export const ResumeSchema = z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),

    linkedin: z.string().nullable(),
    github: z.string().nullable(),
    portfolio: z.string().nullable(),
    education: z.array(EducationSchema),
    experience: z.array(ExperienceSchema),
    projects: z.array(ProjectSchema),
    achievements: z.array(z.string()),
    skills: z.array(z.string()),

    codingProfiles: z.object({
        leetcode: z.object({
            profileUrl: z.string().nullable(),
            rating: z.string().nullable(),
            rank: z.string().nullable(),
            solvedProblems: z.string().nullable()
        }),
        codeforces: z.object({
            profileUrl: z.string().nullable(),
            rating: z.string().nullable(),
            rank: z.string().nullable(),
            maxRating: z.string().nullable()
        }),
        codechef: z.object({
            profileUrl: z.string().nullable(),
            rating: z.string().nullable(),
            stars: z.string().nullable()
        }),
        hackerrank: z.object({
            profileUrl: z.string().nullable(),
            badges: z.array(z.string())
        })
    })
})

export type Resume = z.infer<typeof ResumeSchema>