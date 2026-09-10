import { z } from "zod";

const EducationSchema = z.object({
    institution: z.string().nullable().optional(),
    degree: z.string().nullable().optional(),
    cgpa: z.string().nullable().optional(),
    duration: z.string().nullable().optional(),
    relevantCoursework: z.array(z.string()).nullish().transform(val => val ?? [])
})

const ExperienceSchema = z.object({
    company: z.string().nullable().optional(),
    role: z.string().nullable().optional(),
    duration: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    description: z.array(z.string()).nullish().transform(val => val ?? [])
})

const ProjectSchema = z.object({
    title: z.string().nullable().optional(),
    techStack: z.array(z.string()).nullish().transform(val => val ?? []),
    highlights: z.array(z.string()).nullish().transform(val => val ?? [])
})

export const ResumeSchema = z.object({
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),

    linkedin: z.string().nullable().optional(),
    github: z.string().nullable().optional(),
    portfolio: z.string().nullable().optional(),
    education: z.array(EducationSchema).nullish().transform(val => val ?? []),
    experience: z.array(ExperienceSchema).nullish().transform(val => val ?? []),
    projects: z.array(ProjectSchema).nullish().transform(val => val ?? []),
    achievements: z.array(z.string()).nullish().transform(val => val ?? []),
    skills: z.array(z.string()).nullish().transform(val => val ?? []),

    codingProfiles: z.object({
        leetcode: z.object({
            profileUrl: z.string().nullable().optional(),
            rating: z.string().nullable().optional(),
            rank: z.string().nullable().optional(),
            solvedProblems: z.string().nullable().optional()
        }).nullish(),
        codeforces: z.object({
            profileUrl: z.string().nullable().optional(),
            rating: z.string().nullable().optional(),
            rank: z.string().nullable().optional(),
            maxRating: z.string().nullable().optional()
        }).nullish(),
        codechef: z.object({
            profileUrl: z.string().nullable().optional(),
            rating: z.string().nullable().optional(),
            stars: z.string().nullable().optional()
        }).nullish(),
        hackerrank: z.object({
            profileUrl: z.string().nullable().optional(),
            badges: z.array(z.string()).nullish().transform(val => val ?? [])
        }).nullish()
    }).nullish().transform(val => val ?? {})
})

export type Resume = z.infer<typeof ResumeSchema>