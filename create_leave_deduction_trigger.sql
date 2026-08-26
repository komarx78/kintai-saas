-- ==========================================
-- 有給休暇消費ロジック PostgreSQLトリガー
-- ==========================================

-- 申請ステータスが「承認」になった際に有給残数を減算する関数
CREATE OR REPLACE FUNCTION deduct_paid_leave_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  days_to_deduct INT;
  emp RECORD;
  remaining_deduct NUMERIC(5,2);
  current_carryover NUMERIC(5,2);
  current_balance NUMERIC(5,2);
BEGIN
  -- ステータスが「申請中」から「承認」に変わり、かつタイプが「有給休暇」の場合のみ実行
  IF NEW.status = '承認' AND OLD.status != '承認' AND NEW.type = '有給休暇' THEN
    
    -- 申請された日数を計算 (end_date - start_date + 1)
    -- ※本来は間に挟まる土日や祝日を除外する必要がありますが、シンプルな実装として単純な日数差分とします
    days_to_deduct := (NEW.end_date - NEW.start_date) + 1;
    remaining_deduct := days_to_deduct;
    
    -- ユーザーの現在の有給残数を取得
    SELECT * INTO emp FROM users WHERE id = NEW.user_id;
    current_carryover := COALESCE(emp.paid_leave_carryover, 0);
    current_balance := COALESCE(emp.paid_leave_balance, 0);
    
    -- 1. 古い繰越分（carryover）から優先して減算
    IF current_carryover >= remaining_deduct THEN
      current_carryover := current_carryover - remaining_deduct;
      remaining_deduct := 0;
    ELSE
      remaining_deduct := remaining_deduct - current_carryover;
      current_carryover := 0;
    END IF;
    
    -- 2. 足りない場合は今年付与分（balance）から減算
    IF remaining_deduct > 0 THEN
      IF current_balance >= remaining_deduct THEN
        current_balance := current_balance - remaining_deduct;
        remaining_deduct := 0;
      ELSE
        -- 残数が足りない場合でもマイナスにする（本来はUI側で制限するかここでエラーにする）
        current_balance := current_balance - remaining_deduct;
        remaining_deduct := 0;
      END IF;
    END IF;
    
    -- ユーザーテーブルの残数を更新
    UPDATE users 
    SET 
      paid_leave_carryover = current_carryover,
      paid_leave_balance = current_balance
    WHERE id = NEW.user_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- leave_requests テーブルにトリガーを設定
DROP TRIGGER IF EXISTS deduct_paid_leave_trigger ON leave_requests;
CREATE TRIGGER deduct_paid_leave_trigger
AFTER UPDATE ON leave_requests
FOR EACH ROW
EXECUTE FUNCTION deduct_paid_leave_on_approval();
