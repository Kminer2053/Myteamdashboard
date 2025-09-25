const express = require('express');
const router = express.Router();
const WeightSetting = require('../models/WeightSetting');

// 가중치 설정 조회
router.get('/', async (req, res) => {
    try {
        const settings = await WeightSetting.findOne({ isActive: true });
        
        if (!settings) {
            // 기본 설정이 없으면 생성
            const defaultSettings = new WeightSetting({
                name: '기본 설정',
                description: '기본 가중치 설정'
            });
            await defaultSettings.save();
            
            return res.json({
                success: true,
                settings: defaultSettings
            });
        }
        
        res.json({
            success: true,
            settings: settings
        });
    } catch (error) {
        console.error('가중치 설정 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '가중치 설정 조회 중 오류가 발생했습니다.'
        });
    }
});

// 가중치 설정 저장
router.post('/', async (req, res) => {
    try {
        const { exposure, engagement, demand, overall, engagementDetail } = req.body;
        
        // 가중치 합계 검증
        const exposureSum = Object.values(exposure).reduce((sum, weight) => sum + weight, 0);
        const engagementSum = Object.values(engagement).reduce((sum, weight) => sum + weight, 0);
        const demandSum = Object.values(demand).reduce((sum, weight) => sum + weight, 0);
        const overallSum = Object.values(overall).reduce((sum, weight) => sum + weight, 0);
        const engagementDetailSum = Object.values(engagementDetail).reduce((sum, weight) => sum + weight, 0);
        
        if (Math.abs(exposureSum - 1) > 0.01) {
            return res.status(400).json({
                success: false,
                message: '노출 지수 가중치의 합이 1이어야 합니다.'
            });
        }
        
        if (Math.abs(engagementSum - 1) > 0.01) {
            return res.status(400).json({
                success: false,
                message: '참여 지수 가중치의 합이 1이어야 합니다.'
            });
        }
        
        if (Math.abs(demandSum - 1) > 0.01) {
            return res.status(400).json({
                success: false,
                message: '수요 지수 가중치의 합이 1이어야 합니다.'
            });
        }
        
        if (Math.abs(overallSum - 1) > 0.01) {
            return res.status(400).json({
                success: false,
                message: '종합 지수 가중치의 합이 1이어야 합니다.'
            });
        }
        
        if (Math.abs(engagementDetailSum - 1) > 0.01) {
            return res.status(400).json({
                success: false,
                message: '참여도 세부 가중치의 합이 1이어야 합니다.'
            });
        }
        
        // 기존 활성 설정을 비활성화
        await WeightSetting.updateMany({ isActive: true }, { isActive: false });
        
        // 새 설정 생성
        const newSettings = new WeightSetting({
            exposure,
            engagement,
            demand,
            overall,
            engagementDetail,
            name: '사용자 설정',
            description: '관리자가 설정한 가중치',
            isActive: true
        });
        
        await newSettings.save();
        
        res.json({
            success: true,
            message: '가중치 설정이 저장되었습니다.',
            settings: newSettings
        });
    } catch (error) {
        console.error('가중치 설정 저장 오류:', error);
        res.status(500).json({
            success: false,
            message: '가중치 설정 저장 중 오류가 발생했습니다.'
        });
    }
});

// 가중치 설정 히스토리 조회
router.get('/history', async (req, res) => {
    try {
        const settings = await WeightSetting.find()
            .sort({ createdAt: -1 })
            .limit(10);
        
        res.json({
            success: true,
            settings: settings
        });
    } catch (error) {
        console.error('가중치 설정 히스토리 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '가중치 설정 히스토리 조회 중 오류가 발생했습니다.'
        });
    }
});

// 특정 가중치 설정 활성화
router.post('/activate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 기존 활성 설정을 비활성화
        await WeightSetting.updateMany({ isActive: true }, { isActive: false });
        
        // 선택된 설정을 활성화
        const settings = await WeightSetting.findByIdAndUpdate(
            id,
            { isActive: true },
            { new: true }
        );
        
        if (!settings) {
            return res.status(404).json({
                success: false,
                message: '가중치 설정을 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '가중치 설정이 활성화되었습니다.',
            settings: settings
        });
    } catch (error) {
        console.error('가중치 설정 활성화 오류:', error);
        res.status(500).json({
            success: false,
            message: '가중치 설정 활성화 중 오류가 발생했습니다.'
        });
    }
});

module.exports = router;
