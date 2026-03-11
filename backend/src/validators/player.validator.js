import * as z from "zod"; 
import Player from "../models/Player.model.js";

export const PlayerZod = z.object({
    name: z.string("Name must be a string").min(2, "Name must not be less than 2 characters."),
    gender: z.enum(['MALE', 'FEMALE'], "Invalid gender. Please select either Male or Female.").nullable().optional(),
    playerLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'UPPERINTERMEDIATE', 'ADVANCED'], "Invalid player level. Please select a valid skill level.").nullable().optional(),
}).superRefine(async (data, ctx) => {
        const nameExist = await Player.exists({
            name: data.name,
            isDeleted: { $ne: true },
        })

        if (nameExist) {
            ctx.addIssue({
                code: "custom",
                path: ["name"],
                message: "An active player with this name already exists.",
            })
        }
});

