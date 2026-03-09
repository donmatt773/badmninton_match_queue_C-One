import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import Player from '../models/Player.model.js'
import { pubsub } from '../configs/pubsub.js'

const router = express.Router()

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/')
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`)
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true)
    } else {
      cb(new Error('Only .txt files are allowed'))
    }
  },
})

/**
 * POST /api/players/bulk
 * Bulk add players from JSON array
 * Body: { players: ["John", "Mark", "Luke"] }
 */
router.post('/bulk', async (req, res) => {
  try {
    const { players } = req.body

    if (!Array.isArray(players) || players.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'Players array is required and must not be empty',
      })
    }

    // Trim names and filter empty strings
    const playerNames = players
      .map((name) => (typeof name === 'string' ? name.trim() : ''))
      .filter((name) => name.length > 0)
      .map((name) => ({ name }))

    if (playerNames.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'No valid player names provided',
      })
    }

    // Insert players, skip duplicates
    const result = await Player.insertMany(playerNames, { ordered: false }).catch(
      (err) => {
        // Return partial success if some inserts failed due to duplicates
        if (err.code === 11000) {
          return err.insertedDocs || []
        }
        throw err
      }
    )

    // Get duplicates by checking which names already exist
    const insertedNames = result.map((doc) => doc.name)
    const providedNames = playerNames.map((p) => p.name)
    const duplicates = providedNames.filter((name) => !insertedNames.includes(name))

    // Publish subscription updates for each newly created player
    result.forEach((player) => {
      pubsub.publish('PLAYER_UPDATED_TRIGGER', {
        playerUpdates: {
          type: 'CREATED',
          player: {
            _id: player._id,
            name: player.name,
            gender: player.gender || null,
            playerLevel: player.playerLevel || 'BEGINNER',
          },
        },
      })
    })

    return res.status(201).json({
      ok: true,
      message: `${insertedNames.length} player(s) added successfully`,
      added: insertedNames.length,
      duplicates: duplicates,
      skipped: duplicates.length,
      players: result,
    })
  } catch (error) {
    console.error('Error bulk adding players:', error)
    return res.status(500).json({
      ok: false,
      message: error.message || 'Failed to add players',
    })
  }
})

/**
 * POST /api/players/upload
 * Bulk add players from uploaded .txt file
 * File: .txt file with one player name per line
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: 'No file provided',
      })
    }

    // Read file content
    const filePath = path.join(process.cwd(), req.file.path)
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // Clean up uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err)
    })

    // Parse lines and clean names
    const playerNames = fileContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((name) => ({ name }))

    if (playerNames.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'No valid player names found in file',
      })
    }

    // Insert players, skip duplicates
    const result = await Player.insertMany(playerNames, { ordered: false }).catch(
      (err) => {
        // Return partial success if some inserts failed due to duplicates
        if (err.code === 11000) {
          return err.insertedDocs || []
        }
        throw err
      }
    )

    // Get duplicates by checking which names already exist
    const insertedNames = result.map((doc) => doc.name)
    const providedNames = playerNames.map((p) => p.name)
    const duplicates = providedNames.filter((name) => !insertedNames.includes(name))

    // Publish subscription updates for each newly created player
    result.forEach((player) => {
      pubsub.publish('PLAYER_UPDATED_TRIGGER', {
        playerUpdates: {
          type: 'CREATED',
          player: {
            _id: player._id,
            name: player.name,
            gender: player.gender || null,
            playerLevel: player.playerLevel || 'BEGINNER',
          },
        },
      })
    })

    return res.status(201).json({
      ok: true,
      message: `${insertedNames.length} player(s) added successfully`,
      added: insertedNames.length,
      duplicates: duplicates,
      skipped: duplicates.length,
      players: result,
    })
  } catch (error) {
    console.error('Error uploading players:', error)
    return res.status(500).json({
      ok: false,
      message: error.message || 'Failed to upload players',
    })
  }
})

export default router
