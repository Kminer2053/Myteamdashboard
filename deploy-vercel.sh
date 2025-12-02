#!/bin/bash

# Vercel Deploy Hook URL
DEPLOY_HOOK_URL="https://api.vercel.com/v1/integrations/deploy/prj_sy6FrZZ7JklPyPcogIfpLaKQ1T5E/BSJGtb3sYO"

echo "🚀 Vercel 배포 트리거 중..."
response=$(curl -s -X POST "$DEPLOY_HOOK_URL")

if echo "$response" | grep -q "job"; then
    echo "✅ 배포가 성공적으로 트리거되었습니다!"
    echo "📊 응답: $response"
    echo ""
    echo "Vercel 대시보드에서 배포 상태를 확인하세요:"
    echo "https://vercel.com/dashboard"
else
    echo "❌ 배포 트리거 실패"
    echo "응답: $response"
fi

