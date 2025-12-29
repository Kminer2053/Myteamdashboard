#!/bin/bash
# Git hooks 설치 스크립트
# 뉴스클리핑 파일 커밋 방지 hook 설치

HOOKS_DIR=".git/hooks"
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"

# pre-commit hook 생성
cat > "$PRE_COMMIT_HOOK" << 'EOF'
#!/bin/sh
#
# Pre-commit hook to prevent committing news_clipping files
# 뉴스클리핑 파일이 메인 리포지토리에 커밋되는 것을 방지

# 커밋하려는 파일 목록 가져오기
files=$(git diff --cached --name-only --diff-filter=ACM)

# news_clipping 파일이 포함되어 있는지 확인
if echo "$files" | grep -q "^news_clipping/"; then
    echo "❌ 오류: news_clipping/ 폴더의 파일은 메인 리포지토리에 커밋할 수 없습니다."
    echo ""
    echo "뉴스클리핑은 별도 리포지토리(NewsClipping)로 관리됩니다."
    echo "다음 명령어로 뉴스클리핑 리포지토리에서 커밋하세요:"
    echo "  cd news_clipping && git add . && git commit -m '메시지' && git push"
    echo ""
    echo "커밋하려는 news_clipping 파일:"
    echo "$files" | grep "^news_clipping/"
    echo ""
    exit 1
fi

exit 0
EOF

# 실행 권한 부여
chmod +x "$PRE_COMMIT_HOOK"

echo "✅ Git hooks 설치 완료!"
echo "   - pre-commit hook: news_clipping 파일 커밋 방지"

