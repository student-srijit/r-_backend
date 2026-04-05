import ResearchWork from '../models/ResearchWork.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { validateURL } from '../utils/validators.js';
import { createLLMService } from '../services/llmService.js';

export const createResearchWork = async (req, res, next) => {
  try {
    const { title, description, field, difficulty, tags, notes } = req.body;

    if (!title || title.length < 5) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Title must be at least 5 characters',
      });
    }

    const researchWork = new ResearchWork({
      userId: req.userId,
      title,
      description: description || '',
      field: field || 'Other',
      difficulty: difficulty || 'intermediate',
      tags: tags || [],
      notes: notes || '',
    });

    await researchWork.save();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Research work created successfully',
      data: researchWork,
    });
  } catch (error) {
    next(error);
  }
};

export const getResearchWorks = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, field, difficulty } = req.query;
    const skip = (page - 1) * limit;

    const filter = { userId: req.userId };
    if (field) filter.field = field;
    if (difficulty) filter.difficulty = difficulty;

    const works = await ResearchWork.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ResearchWork.countDocuments(filter);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        data: works,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getResearchWork = async (req, res, next) => {
  try {
    const { id } = req.params;

    const work = await ResearchWork.findById(id);
    if (!work) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Research work not found',
      });
    }

    if (work.userId.toString() !== req.userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to access this resource',
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: work,
    });
  } catch (error) {
    next(error);
  }
};

export const updateResearchWork = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, field, difficulty, tags, notes } = req.body;

    let work = await ResearchWork.findById(id);
    if (!work) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Research work not found',
      });
    }

    if (work.userId.toString() !== req.userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to update this resource',
      });
    }

    if (title) work.title = title;
    if (description) work.description = description;
    if (field) work.field = field;
    if (difficulty) work.difficulty = difficulty;
    if (tags) work.tags = tags;
    if (notes) work.notes = notes;

    work.updatedAt = new Date();
    await work.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Research work updated successfully',
      data: work,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteResearchWork = async (req, res, next) => {
  try {
    const { id } = req.params;

    const work = await ResearchWork.findById(id);
    if (!work) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Research work not found',
      });
    }

    if (work.userId.toString() !== req.userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to delete this resource',
      });
    }

    await ResearchWork.findByIdAndDelete(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Research work deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const addLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { url, type } = req.body;

    if (!url || !validateURL(url)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Valid URL is required',
      });
    }

    const work = await ResearchWork.findById(id);
    if (!work) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Research work not found',
      });
    }

    if (work.userId.toString() !== req.userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Not authorized',
      });
    }

    work.links.push({
      url,
      type: type || 'other',
      addedAt: new Date(),
    });

    await work.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Link added successfully',
      data: work,
    });
  } catch (error) {
    next(error);
  }
};

export const generateFlashcards = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { apiKey, provider, model, baseUrl } = req.body;

    if (!apiKey || !provider || !model) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'API key, provider, and model are required',
      });
    }

    const work = await ResearchWork.findById(id);
    if (!work) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Research work not found',
      });
    }

    if (work.userId.toString() !== req.userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const analysisSummaries = work.links
      .filter((l) => l.analysis && l.analysis.summary)
      .map((l) => l.analysis.summary);

    if (analysisSummaries.length === 0 && !work.description) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'No analyzed content available. Analyze at least one link first.',
      });
    }

    const llmService = createLLMService(apiKey, provider, model, baseUrl);
    const flashcards = await llmService.generateFlashcards(work.title, analysisSummaries);

    const cards = Array.isArray(flashcards)
      ? flashcards
      : [];

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: cards,
    });
  } catch (error) {
    const message = error.message.includes('API key')
      ? 'Invalid API key or provider'
      : error.message;
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
  }
};
