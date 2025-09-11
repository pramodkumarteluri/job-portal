import Job from "../models/Job.js"
import JobApplication from "../models/JobApplication.js"
import User from "../models/User.js"
import { v2 as cloudinary } from "cloudinary"
import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Get User Data
export const getUserData = async (req, res) => {
    const userId = req.auth.userId // Clerk userId

    try {
        let user = await User.findById(userId)

        // If user not found in MongoDB, fetch from Clerk and create
        if (!user) {
            const clerkUser = await clerkClient.users.getUser(userId)

            user = await User.create({
                _id: userId, // Store Clerk ID as Mongo _id
                name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
                email: clerkUser.emailAddresses[0].emailAddress,
                image: clerkUser.imageUrl,
            })
        }

        res.json({ success: true, user })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// Apply For Job
export const applyForJob = async (req, res) => {
    const { jobId } = req.body
    const userId = req.auth.userId

    try {
        const isAlreadyApplied = await JobApplication.find({ jobId, userId })

        if (isAlreadyApplied.length > 0) {
            return res.json({ success: false, message: "Already Applied" })
        }

        const jobData = await Job.findById(jobId)
        if (!jobData) {
            return res.json({ success: false, message: "Job Not Found" })
        }

        await JobApplication.create({
            companyId: jobData.companyId,
            userId,
            jobId,
            date: Date.now(),
        })

        res.json({ success: true, message: "Applied Successfully" })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// Get User Job Applications
export const getUserJobApplications = async (req, res) => {
    try {
        const userId = req.auth.userId

        const applications = await JobApplication.find({ userId })
            .populate("companyId", "name email image")
            .populate("jobId", "title description location category level salary")
            .exec()

        if (!applications || applications.length === 0) {
            return res.json({ success: false, message: "No job applications found for this user." })
        }

        return res.json({ success: true, applications })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// Update User Resume
export const updateUserResume = async (req, res) => {
    try {
        const userId = req.auth.userId
        const resumeFile = req.file

        const userData = await User.findById(userId)
        if (!userData) {
            return res.json({ success: false, message: "User Not Found" })
        }

        if (resumeFile) {
            const resumeUpload = await cloudinary.uploader.upload(resumeFile.path)
            userData.resume = resumeUpload.secure_url
        }

        await userData.save()

        return res.json({ success: true, message: "Resume Updated" })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}